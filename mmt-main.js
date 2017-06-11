"use latest";
"use strict";
const shipit = require('shipit');


import clearCommand from './commands/clear';
import cronEmailCommand from './commands/cron-email';
import cronUpdateCommand from './commands/cron-update';
import dumpCommand from './commands/dump';
import scanBodyCommand from './commands/scan-body';
const CLEAR = "clear";
const CRON_EMAIL = "cron-email";
const CRON_UPDATE = "cron-update";
const DEFAULT = "scan-body";
const DUMP = "dump";

module.exports = function (ctx, cb) {
    const carriers = configCarriers(ctx.secrets);

    let command = ctx.data.command || DEFAULT;
    
    // Accessing ctx.meta.command directly gives error on debug console (ctx.meta seems to be undefined) 
    if (ctx.meta && ctx.meta.command ) {
        command = ctx.meta.command;
    }

    switch (command) {
        case CRON_EMAIL:
            cronEmailCommand(ctx.secrets, ctx.storage, cb);
            break;
        case CRON_UPDATE:
            cronUpdateCommand(ctx.secrets, ctx.storage, carriers, cb);
            break;
        case DUMP:
            dumpCommand(ctx.storage, (error,data) => {
                if (error) return cb(error);
                cb(null, data);
            });
            break;
        case CLEAR:
            clearCommand(ctx.storage, (error,data) => {
                if (error) return cb(error);
                cb(null, "Tracking IDs Cleared.");
            });
            break;
        case DEFAULT:
        default:
            scanBodyCommand(ctx.secrets, ctx.storage, ctx.data.body, carriers, cb);
    }
};

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

