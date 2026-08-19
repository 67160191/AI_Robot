const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

async function run() {
    try {
        await client.connectTCP("127.0.0.1", { port: 502 });
        client.setID(1);
        console.log("Connected. Toggling all coils 0-10...");
        
        let state = true;
        for (let i = 0; i <= 10; i++) {
            try {
                await client.writeCoil(i, state);
                console.log(`Wrote Coil ${i} -> ${state}`);
            } catch(e) {
                console.error(`Error on Coil ${i}:`, e.message);
            }
        }
        
        let res = await client.readCoils(0, 10);
        console.log("Coils after write:", res.data);
        client.close();
    } catch(e) {
        console.error("Connect Error:", e.message);
    }
}
run();
