const shipit = require('shipit');
const SEARCH_REGEX = new RegExp(["1Z[0-9A-Z]{16}|(H|T|J|K|F|W|M|Q|A)\\d{10}|1\\d{2}-\\d{7}-\\d{7}:\\d{13}|",
                                 "02\\d{18}|02\\d{18}|DT\\d{12}|927489\\d{16}|926129\\d{16}|",
                                 "927489\\d{16}|926129\\d{16}|927489\\d{20}|96\\d{20}|927489\\d{16}|926129\\d{16}|",
                                 "7489\\d{16}|6129\\d{16}|(91|92|93|94|95|96)\\d{20}|\\d{26}|420\\d{27}|420\\d{31}|",
                                 "420\\d{27}|420\\d{31}|94748\\d{17}|93612\\d{17}|GM\\d{16}|[A-Z]{2}\\d{9}[A-Z]{2}|",
                                 "L[A-Z]\\d{8}|1LS\\d{12}|Q\\d{8}[A-Z]|(C|D)\\d{14}|P[A-Z]{1}\\d{8}|AZ.\\d+|\\d{20}|\\d{16}|\\d{15}|\\d{12}"].join(''), "g")
const AMZN_REGEX = /(?:orderId=)([^&]+).+(?:shipmentId=)([^&]+)/g

export default function scanBodyCommand(secrets, storage, body, carriers, cb) {
    storage.get( (error, data) => {
        if (error) return cb(error);
        data = data || {trackingIDs: []};
        body = body || "";
        const foundIDs = body.match(SEARCH_REGEX) || [];
        const carrierList = foundIDs.map((tid) => (shipit.guessCarrier(tid)));
        const validIDs = [];
        const trackers = data.trackers || {};
        console.log(body);
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
            storage.set(data, function(error) {
                if (error) return cb(error);
                return cb(null, {code: 200, name: "Success", message: "Tracking IDs Stored."});
            });
        } else {
            cb(null, {code: 200, name: "Success", message: "No tracking IDs foumd."})
        }
    });
}