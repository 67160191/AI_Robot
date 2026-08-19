const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

async function run() {
    try {
        await client.connectTCP("127.0.0.1", { port: 502 });
        client.setID(1);
        let res = await client.readCoils(0, 7);
        console.log("Current Coils (0-6):", res.data);
        client.close();
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
