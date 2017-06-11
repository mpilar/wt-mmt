const shipit = require('shipit');
export default function cronEmailCommand(secrets, storage, carriers, cb) {
    storage.get((error, data) => {
        if (error) return cb(error);
        
        data = data || {trackingIDs: []};
        const trackingIDs = data.trackingIDs || [];
        const trackers = data.trackers || {};

        if(trackingIDs.length == 0) return cb(null, {code: 200, name: "Success", message: "No tracking IDs stored."});
        
        for (var tid of trackingIDs) {
            // Handle special amazon case, it needs extra data from the regex.
            let carrier = "";

            if( trackers[tid] && trackers[tid].carrier ) carrier = trackers[tid].carrier;
            if( trackers[tid].status == 4 ) continue; // Delivered, don't look it up again.
            
            const reqData = {storage: storage, data: data};
            if ( carrier === "amazon") {
                reqData.orderId = tid;
                reqData.orderingShipmentId =trackers[tid].shipmentId;
            } else {
                reqData.trackingNumber = tid
            }
            carriers[carrier].requestData( reqData, _carrierRequestCallback);
        }
        cb(null, {code: 200, name: "Success", message: "Data updated."});
    });
}

function _carrierRequestCallback(error, result) {
    console.log("_carroerRequestCallback");
    console.log(result);
    console.log(error);
    if (error) {
        console.log(error)
        return;
    }
    

    if (result && result.request) {
        let trackingID = result.request['orderId'] || result.request['trackingNumber'];
        let innerStorage = result.request.storage;
        let data = result.request.data;
        delete result.request.storage;
        delete result.request.data;
        if (!innerStorage) return;
        data.trackers[trackingID].progress = result.activities.map((obj) => Object.assign({}, obj));
        data.trackers[trackingID].service = result.service;
        data.trackers[trackingID].status = result.status;
        if (result.status == 4 ) { // This can only happen once because of code below
            //data.done_packages holds list of email details to send.
            data.done_packages = data.done_packages || [];
            data.done_packages.push({trackingID: trackingID, carrier: data.trackers[trackingID].carrier});
        }
        innerStorage.set(data, function(error) {
            if(error) {
                console.log("Error while saving data in _carrierRequestCallback:");
                console.log(error);
            }
        });
    }
};