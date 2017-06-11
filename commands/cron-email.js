const nodemailer = false; //removed require('nodemailer'), failing to compile on webtask.io;

export default function cronEmailCommand(secrets, storage, cb) {
    storage.get( (error, data) => {
        if (error) return cb(error);
        if (!data || !data.done_packages) return cb(null, {code: 200, name: "Success", message: "No mail updates to send."});
        const done_packages = data.done_packages;
        if (done_packages.length) {
            _sendMails(secrets, done_packages);
            data.done_packages = [];
            storage.set(data, function(error) {
                if (error) return cb(error);
                cb(null, {code: 200, name: "Success", message: "Done."});
            });
        }
    });    
}

function _sendMails(secrets, done_packages) {
    const mailer = Emailer.getMailerFromSecrets(secrets);
    if (!mailer) return cb(null, {code: 500, name: "Configuration Error", message: "No mailer is configured."});
    for(var pack of done_packages) {
        mailer.sendMail(pack, (error, info) => {
            if(error) return console.log(error);
            console.log(info);
        });
    }
}

class Emailer {
    constructor(configObj) {
        return;
    }
    sendMail(trackingInfo, callback) {
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
        super();
        this.configObj = configObj;
        if (!configObj.MAIL_SG_API_KEY) {return null;}
        this.sendgrid = require('sendgrid')(configObj.MAIL_SG_API_KEY);
        this.helper = require('sendgrid').mail;
    }

    _createMailOptions (trackingInfo) {
        const fromEmail = new this.helper.Email(this.configObj.MAIL_FROM_ADDRESS || this.configObj.MAIL_USER);
        const toEmail = new this.helper.Email(this.configObj.MAIL_TO || this.configObj.MAIL_USER);
        const subject = this.configObj.MAIL_SUBJECT || "Mail delivery";
        const content = new this.helper.Content('text/plain', "You received the package with Tracking Number: " + trackingInfo.trackingID + " from " + trackingInfo.carrier)
        return new this.helper.Mail(fromEmail, subject, toEmail, content);
    }
    sendMail(trackingInfo, callback) {
        let mail = this._createMailOptions(trackingInfo);
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
        super();
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

    _createMailOptions (trackingInfo) {
        return {
            from: this.configObj.MAIL_FROM_ADDRESS || this.configObj.MAIL_USER,
            to: this.configObj.MAIL_TO || this.configObj.MAIL_USER,
            subject: this.configObj.MAIL_SUBJECT || "Mail delivery",
            text: "You received the package with Tracking Number: " + trackingInfo.trackingID + " from " + trackingInfo.carrier
        }
    }

    sendMail(trackingInfo, callback) {
        this.mailer.sendMail(this._createMailOptions(trackingInfo), callback);
    }
}
