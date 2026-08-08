#!/usr/bin/env python3
# =============================================================
#  🤖  AI Robot Operator — Launcher
#  รันไฟล์นี้เพื่อเปิดระบบทั้งหมดและเปิด browser อัตโนมัติ
# =============================================================

import subprocess
import sys
import time
import webbrowser
import threading
import os
import urllib.request
import urllib.error

# ─── การตั้งค่า ───────────────────────────────────────────────
PROJECT_DIR   = os.path.dirname(os.path.abspath(__file__))
FRONTEND_URL  = "http://localhost:5173"         # URL ที่จะเปิดใน browser (frontend)
BACKEND_URL   = "http://localhost:3001/health"   # ใช้ตรวจสอบว่า backend พร้อมแล้ว
FRONTEND_PORT = 5173                             # port ของ frontend dev server
OLLAMA_URL    = "http://10.80.84.24:11434"        # AI model server (ใช้ตรวจสอบการเชื่อมต่อ)

# สีสำหรับ console (รองรับ Windows ด้วย)
try:
    import ctypes
    ctypes.windll.kernel32.SetConsoleMode(
        ctypes.windll.kernel32.GetStdHandle(-11), 7
    )
except Exception:
    pass

CYAN    = "\033[96m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
RED     = "\033[91m"
MAGENTA = "\033[95m"
RESET   = "\033[0m"
BOLD    = "\033[1m"


def print_banner():
    print(f"""
{CYAN}{BOLD}╔══════════════════════════════════════════════╗
║      🤖  AI Robot Operator — Launcher        ║
║      กำลังเริ่มระบบ...                         ║
╚══════════════════════════════════════════════╝{RESET}
""")


def is_url_up(url: str, timeout: int = 2) -> bool:
    """ตรวจสอบว่า URL ตอบสนองหรือยัง"""
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


def wait_for_service(url: str, label: str, max_wait: int = 60) -> bool:
    """รอจนกว่า service จะพร้อม หรือ timeout"""
    print(f"{YELLOW}⏳ รอ {label} พร้อมใช้งาน...{RESET}", end="", flush=True)
    for i in range(max_wait):
        if is_url_up(url):
            print(f" {GREEN}✅ พร้อมแล้ว!{RESET}")
            return True
        time.sleep(1)
        print(".", end="", flush=True)
    print(f" {RED}❌ timeout!{RESET}")
    return False


def open_browser_when_ready():
    """รอให้ frontend พร้อม แล้วค่อยเปิด browser"""
    frontend_check = f"http://localhost:{FRONTEND_PORT}"
    
    # รอ backend ก่อน (ถ้า backend มี)
    wait_for_service(BACKEND_URL, "Backend", max_wait=30)
    
    # รอ frontend
    if wait_for_service(frontend_check, "Frontend", max_wait=60):
        print(f"\n{GREEN}{BOLD}🌐 เปิด browser ไปที่ {FRONTEND_URL}{RESET}\n")
        time.sleep(1)  # หน่วงเล็กน้อยให้ server เสถียร
        webbrowser.open(FRONTEND_URL)
    else:
        print(f"\n{RED}⚠️  ไม่สามารถเชื่อมต่อ frontend ได้ ลองเปิด {FRONTEND_URL} เอง{RESET}")


def get_npm_command():
    """หา npm command ที่ถูกต้องสำหรับ Windows"""
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"


def main():
    print_banner()

    npm = get_npm_command()

    print(f"{CYAN}📂 Project Directory: {PROJECT_DIR}{RESET}")
    print(f"{CYAN}🌐 Frontend (เว็บ):   {FRONTEND_URL}{RESET}")
    print(f"{CYAN}🤖 AI Model Server:   {OLLAMA_URL}{RESET}")
    print(f"{CYAN}⚙️  Backend Check:     {BACKEND_URL}{RESET}\n")

    # ─── เปิด browser ใน thread แยก (รอ service พร้อมก่อน) ─────────
    browser_thread = threading.Thread(target=open_browser_when_ready, daemon=True)
    browser_thread.start()

    # ─── รัน npm run dev ─────────────────────────────────────────
    print(f"{MAGENTA}🚀 กำลังรัน: npm run dev{RESET}\n")
    print("─" * 50)

    try:
        proc = subprocess.Popen(
            [npm, "run", "dev"],
            cwd=PROJECT_DIR,
            # ไม่ redirect output — ให้แสดงใน terminal ตามปกติ
        )

        print(f"\n{GREEN}✅ ระบบเริ่มทำงานแล้ว (PID: {proc.pid}){RESET}")
        print(f"{YELLOW}💡 กด Ctrl+C เพื่อหยุดระบบทั้งหมด{RESET}\n")

        proc.wait()

    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}🛑 กำลังหยุดระบบ...{RESET}")
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        print(f"{GREEN}✅ ระบบหยุดทำงานแล้ว{RESET}")

    except FileNotFoundError:
        print(f"\n{RED}❌ ไม่พบ npm — กรุณาติดตั้ง Node.js ก่อน{RESET}")
        print(f"   ดาวน์โหลดได้ที่: https://nodejs.org/")
        sys.exit(1)


if __name__ == "__main__":
    main()
