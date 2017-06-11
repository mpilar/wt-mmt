"use latest";
"use strict";

const shipit = require('shipit');
const nodemailer = false; //removed require('nodemailer'), failing to compile on webtask.io;


const SEARCH_REGEX = new RegExp(["1Z[0-9A-Z]{16}|(H|T|J|K|F|W|M|Q|A)\\d{10}|1\\d{2}-\\d{7}-\\d{7}:\\d{13}|",
                                 "02\\d{18}|02\\d{18}|DT\\d{12}|927489\\d{16}|926129\\d{16}|",
                                 "927489\\d{16}|926129\\d{16}|927489\\d{20}|96\\d{20}|927489\\d{16}|926129\\d{16}|",
                                 "7489\\d{16}|6129\\d{16}|(91|92|93|94|95|96)\\d{20}|\\d{26}|420\\d{27}|420\\d{31}|",
                                 "420\\d{27}|420\\d{31}|94748\\d{17}|93612\\d{17}|GM\\d{16}|[A-Z]{2}\\d{9}[A-Z]{2}|",
                                 "L[A-Z]\\d{8}|1LS\\d{12}|Q\\d{8}[A-Z]|(C|D)\\d{14}|P[A-Z]{1}\\d{8}|AZ.\\d+|\\d{20}|\\d{16}|\\d{15}|\\d{12}"].join(''), "g")
const AMZN_REGEX = /(?:orderId=)([^&]+).+(?:shipmentId=)([^&]+)/g


module.exports = function (ctx, cb) {
    let carriers = configCarriers(ctx.secrets);

    let command = ctx.data.command || "default";
    
    // Accessing ctx.meta.command directly gives error on debug console (ctx.meta seems to be undefined) 
    if (ctx.meta && ctx.meta.command ) {
        command = ctx.meta.command;
    }

    switch (command) {
        case "cron-email":
            ctx.storage.get( (error, data) => {
                if (error) return cb(error);
                if (!data || !data.done_packages) return cb(null, {code: 200, name: "Success", message: "No mail updates to send."});
                let done_packages = data.done_packages;
                if (done_packages.length) {
                    //let mailer = createMailTransporterFromContext(ctx);
                    let mailer = Emailer.getMailerFromSecrets(ctx.secrets);
                    if (!mailer) return cb(null, {code: 500, name: "Configuration Error", message: "No mailer is configured."});
                    for(var pack of done_packages) {
                        mailer.sendMail(pack, (error, info) => {
                            if(error) return console.log(error);
                            console.log(info);
                        });
                    }
                    data.done_packages = [];
                    ctx.storage.set(data, function(error) {
                        if (error) return cb(error);
                        cb(null, {code: 200, name: "Success", message: "Done."});
                    });
                }
            });
            break;
        case "cron-update":
            ctx.storage.get((error, data) => {
                if (error) return cb(error);
                
                data = data || {trackingIDs: []};
                let trackingIDs = data.trackingIDs || [];
                let trackers = data.trackers || {};

                if(trackingIDs.length == 0) return cb(null, {code: 200, name: "Success", message: "No tracking IDs stored."});

                let carrierRequestCallback = (error, result) => {
                    if (error) {
                        console.log(error)
                        return;
                    }

                    if (result && result.request) {
                        let trackingID = result.request['orderId'] || result.request['trackingNumber'];
                        let innerCtx = result.request.ctx;
                        delete result.request.ctx;
                        if (!innerCtx) return;
                        data.trackers[trackingID].progress = result.activities.map((obj) => Object.assign({}, obj));
                        data.trackers[trackingID].service = result.service;
                        data.trackers[trackingID].status = result.status;
                        if (result.status == 4 ) { // This can only happen once because of code below
                            //data.done_packages holds list of email details to send.
                            data.done_packages = data.done_packages || [];
                            data.done_packages.push({trackingID: trackingID, carrier: data.trackers[trackingID].carrier});
                        }
                        innerCtx.storage.set(data, function(error) {
                            if (error) return cb(error);
                        });
                    }
                };
                for (var tid of trackingIDs) {
                    // Handle special amazon case, it needs extra data from the regex.
                    let carrier = "";
                    let carrierData = null;
                    if( trackers[tid] && trackers[tid].carrier ) carrier = trackers[tid].carrier;
                    if( trackers[tid].status == 4 ) continue; // Delivered, don't look it up again.
                    let reqData = {ctx: ctx};
                    if ( carrier === "amazon") {
                        reqData.orderId = tid;
                        reqData.orderingShipmentId =trackers[tid].shipmentId;
                    } else {
                        reqData.trackingNumber = tid
                    }
                    carrierData = carriers[carrier].requestData( reqData,  carrierRequestCallback);
                }
                cb(null, {code: 200, name: "Success", message: "Data updated."});
            });
            break;
        case "clear":
            ctx.storage.set({trackingIDs: []}, {force: 1}, (error) => {
                if (error) return cb(error);
                cb(null, "Tracking IDs Cleared.");
            });
            break;
        default:
            ctx.storage.get( (error, data) => {
                if (error) return cb(error);
                data = data || {trackingIDs: []};
                let body = ctx.data.body || "";
                let foundIDs = body.match(SEARCH_REGEX) || [];
                let carrierList = foundIDs.map((tid) => (shipit.guessCarrier(tid)));
                let validIDs = [];
                let trackers = ctx.data.trackers || {};
                for (var i = 0; i < foundIDs.length; i++) {
                    for(var c of carrierList[i]) {
                        if (carriers[c]) {
                            validIDs.push(foundIDs[i]);
                            trackers[foundIDs[i]] = { carrier: c, progress: [] }
                            break; //TODO: This is not the right way to handle multiple carriers, 
                                   // there should be a priority list (probably USPS firs then the others that can use USPS)
                        }
                    }
                }
                if (carriers["amazon"]){
                    // Work around shipit's bad AMZN handling.
                    // TODO: Fork and vendor shipit?
                    let amazonMatch = AMZN_REGEX.exec(body);
                    // TODO: Why the heck is this not always working with EXACTLY the same input?
                    if ( amazonMatch ) {
                        trackers[amazonMatch[1]] = { carrier: "amazon", shipmentId: amazonMatch[2], progress: [] };
                        validIDs.push(amazonMatch[1]);
                    }
                }

                if(validIDs.length > 0) {
                    data.trackingIDs = Array.from(new Set(data.trackingIDs.concat(validIDs)));
                    data.trackers = trackers;
                    ctx.storage.set(data, function(error) {
                        if (error) return cb(error);
                        return cb(null, {code: 200, name: "Success", message: "Tracking IDs Stored."});
                    });
                } else {
                    cb(null, {code: 200, name: "Success", message: "No tracking IDs foumd."})
                }
            });    
    }
};

class Emailer {
    constructor(configObj) {
        return;
    }
    sendMail(trackingInfo, callback) {
        return false;
    }
    createMailOptions (trackingInfo) {
        return false;
    }
    static getMailerFromSecrets(secrets) {
        if(nodemailer) {
            return new NodemailerEmailer(secrets);
        } else {
            return new SendgridEmailer(secrets);
        }
    }
}


class SendgridEmailer extends Emailer {
    constructor (configObj) {
        this.configObj = configObj;
        if (!configObj.MAIL_SG_API_KEY) {return null;}
        this.sendgrid = require('sendgrid')(configObj.MAIL_SG_API_KEY);
        this.helper = require('sendgrid').mail;
    }

    createMailOptions (trackingInfo) {
        const fromEmail = new helper.Email(this.configObj.MAIL_FROM_ADDRESS || this.configObj.MAIL_USER);
        const toEmail = new helper.Email(this.configObj.MAIL_TO || this.configObj.MAIL_USER);
        const subject = this.configObj.MAIL_SUBJECT || "Mail delivery";
        const content = new helper.Content('text/plain', "You received the package with Tracking Number: " + trackingInfo.trackingID + " from " + trackingInfo.carrier)
        return new helper.Mail(fromEmail, subject, toEmail, content);
    }
    sendMail(trackingInfo, callback) {
        let mail = createMailOptions(trackingInfo);
        let request = this.sendgrid.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body:mail.toJSON()
        });
        this.sendgrid.API(request, callback);
    }
}


class NodemailerEmailer extends Emailer {
    constructor (configObj) {
        this.configObj = configObj;
        if (!configObj.MAIL_USER) {return null;}
        this.options = {
            auth: {
                user: configObj.MAIL_USER,
                pass: configObj.MAIL_PASSWORD
            }
        }
        if (configObj.MAIL_SERVICE) {
            options.service = configObj.MAIL_SERVICE;
        }
        if (configObj.MAIL_HOST) {
            options.host = configObj.MAIL_HOST;
        }
        if (configObj.MAIL_PORT) {
            options.host = parseInt(configObj.MAIL_PORT);
        }
        if (configObj.MAIL_SECURE) {
            options.host = true;
        }
        this.mailer = nodemailer.createTransport( this.options );
    }

    createMailOptions (trackingInfo) {
        return {
            from: this.configObj.MAIL_FROM_ADDRESS || this.configObj.MAIL_USER,
            to: this.configObj.MAIL_TO || this.configObj.MAIL_USER,
            subject: this.configObj.MAIL_SUBJECT || "Mail delivery",
            text: "You received the package with Tracking Number: " + trackingInfo.trackingID + " from " + trackingInfo.carrier
        }
    }

    sendMail(trackingInfo, callback) {
        this.mailer.sendMail(createMailOptions(trackingInfo), callback);
    }
}


function configCarriers(configObj) {
    //TODO: make this more based on convention, try to lessen code duplication.
    let carriers = {}
    if (configObj.UPS_ENABLED) {
        carriers["ups"] = new shipit.UpsClient( {
                        licenseNumber: configObj.UPS_LICENSE_NUMBER,
                        userId: configObj.UPS_USERID,
                        password: configObj.UPS_PASSWORD
        });
    }
    if (configObj.FEDEX_ENABLED) {
        carriers["fedex"] = new shipit.FedexClient( {
                        key: configObj.FEDEX_KEY,
                        password: configObj.FEDEX_PASSWORD,
                        account: configObj.FEDEX_ACCOUNT,
                        meter: configObj.FEDEX_METER
        });
    }
    if (configObj.USPS_ENABLED) {
        carriers["usps"] = new shipit.UspsClient( {
                        userId: configObj.USPS_USERID,
                        clientIp: configObj.USPS_clientIp || "127.0.0.1"
        });
    }
    if (configObj.DHL_ENABLED) {
        carriers["dhl"] = new shipit.DhlClient( {
                        userId: configObj.DHL_USERID,
                        password: configObj.DHL_PASSWORD
        });
    }
    if (configObj.LASERSHIP_ENABLED) {
        carriers["lasership"] = new shipit.LasershipClient();
    }
    if (configObj.AMAZON_ENABLED) {
        //TODO: amazon carrier seems to not be working, dive into shipit to figure it out
        carriers["amazon"] = new shipit.AmazonClient();
    }
    //TODO: Add more carriers
    return carriers;
}

