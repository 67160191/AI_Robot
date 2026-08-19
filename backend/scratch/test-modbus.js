const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

async function test() {
    try {
        await client.connectTCP("127.0.0.1", { port: 502 });
        client.setID(1);
        
        let coils = [true, false, false, false, false, false, false];
        console.log("Writing FC15...");
        await client.writeCoils(0, coils);
        console.log("Done FC15");

        let res = await client.readCoils(0, 1);
        console.log("Read after FC15:", res.data);

        console.log("Writing FC5...");
        await client.writeCoil(0, true);
        console.log("Done FC5");

        let res2 = await client.readCoils(0, 1);
        console.log("Read after FC5:", res2.data);
        
        client.close();
    } catch(e) {
        console.error("Error:", e.message);
    }
}
test();
