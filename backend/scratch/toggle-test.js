const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

async function run() {
    try {
        await client.connectTCP("127.0.0.1", { port: 502 });
        client.setID(1);
        console.log("Connected to Modbus. Toggling Coil 0 and 1 every second...");

        let state = false;
        setInterval(async () => {
            state = !state;
            try {
                await client.writeCoil(0, state);
                await client.writeCoil(1, state); // Just in case
                console.log(`[Modbus] Wrote Coil 0 & 1 -> ${state ? 'ON' : 'OFF'}`);
            } catch (err) {
                console.error("Write error:", err.message);
            }
        }, 1000);

    } catch(e) {
        console.error("Connection error:", e.message);
    }
}
run();
