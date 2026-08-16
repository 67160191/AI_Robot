const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

async function test() {
    try {
        await client.connectTCP("127.0.0.1", { port: 502 });
        client.setID(1);
        console.log("Connected to Modbus Server");
        
        // Write ON
        await client.writeCoil(0, true);
        console.log("Wrote Coil 0 = ON (true)");
        
        // Read back
        let res = await client.readCoils(0, 1);
        console.log("Read Coil 0:", res.data);
        
        client.close();
    } catch(e) {
        console.error("Modbus Error:", e);
    }
}
test();
