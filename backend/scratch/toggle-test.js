const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

async function run() {
    try {
        await client.connectTCP("127.0.0.1", { port: 502 });
        client.setID(1);
        console.log("Connected. Toggling Coil 0 every 2 seconds...");
        
        let state = false;
        setInterval(async () => {
            state = !state;
            try {
                await client.writeCoil(0, state);
                console.log(`Wrote Coil 0 -> ${state}`);
            } catch(e) {
                console.error("Write Error:", e.message);
            }
        }, 2000);
    } catch(e) {
        console.error("Connect Error:", e.message);
    }
}
run();
