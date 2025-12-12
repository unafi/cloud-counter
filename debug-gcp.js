const { InstancesClient } = require('@google-cloud/compute');

async function main() {
    try {
        console.log("Imported InstancesClient:", InstancesClient);
        const client = new InstancesClient();
        console.log("Client created.");

        const proto = Object.getPrototypeOf(client);
        const methods = Object.getOwnPropertyNames(proto);
        console.log("Available methods:", methods);

        if (client.aggregatedList) {
            console.log("aggregatedList exists.");
        } else {
            console.log("aggregatedList DOES NOT exist.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
