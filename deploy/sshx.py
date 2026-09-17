# -*- coding: utf-8 -*-
"""SSH 部署辅助：非交互执行远程命令 / 上传文件与目录。
连接信息从环境变量读取（避免密码落盘）：
  ANYU_HOST  ANYU_PORT(默认22)  ANYU_USER(默认root)  ANYU_PASS
用法：
  python sshx.py run    "<shell 命令>"
  python sshx.py exists <远程路径>          # 打印 1/0
  python sshx.py upload <本地文件> <远程路径>
  python sshx.py uploaddir <本地目录> <远程目录> [排除名,用逗号分隔]
"""
import os, sys, stat
import paramiko

H = os.environ.get("ANYU_HOST")
PW = os.environ.get("ANYU_PASS")
if not H or not PW:
    sys.exit("缺少 ANYU_HOST/ANYU_PASS")
PORT = int(os.environ.get("ANYU_PORT", "22"))
USER = os.environ.get("ANYU_USER", "root")


def conn():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(H, port=PORT, username=USER, password=PW, timeout=30,
              look_for_keys=False, allow_agent=False)
    return c


def run(cmd):
    c = conn()
    _, out, err = c.exec_command(cmd, timeout=1800)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    rc = out.channel.recv_exit_status()
    if o:
        print(o, end="")
    if e:
        sys.stderr.write("[stderr] " + e)
    print(f"[rc={rc}]")
    c.close()
    return rc


def upload_file(local, remote):
    c = conn()
    s = c.open_sftp()
    s.put(local, remote)
    s.close()
    c.close()
    print(f"uploaded {local} -> {remote}")


def upload_dir(local, remote, excludes):
    c = conn()
    s = c.open_sftp()
    n = 0
    for root, dirs, files in os.walk(local):
        dirs[:] = [d for d in dirs if d not in excludes]
        rel = os.path.relpath(root, local)
        rdir = remote if rel == "." else remote + "/" + rel.replace("\\", "/")
        try:
            s.stat(rdir)
        except IOError:
            _mkdirs(s, rdir)
        for f in files:
            if f in excludes:
                continue
            s.put(os.path.join(root, f), rdir + "/" + f)
            n += 1
    s.close()
    c.close()
    print(f"uploaded {n} files -> {remote}")


def _mkdirs(sftp, path):
    parts = path.split("/")
    cur = ""
    for p in parts:
        cur = p if not cur else cur + "/" + p
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)


def exists(p):
    c = conn()
    s = c.open_sftp()
    try:
        s.stat(p)
        print("1")
    except IOError:
        print("0")
    s.close()
    c.close()


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "run":
        run(sys.argv[2])
    elif mode == "exists":
        exists(sys.argv[2])
    elif mode == "upload":
        upload_file(sys.argv[2], sys.argv[3])
    elif mode == "uploaddir":
        ex = sys.argv[4].split(",") if len(sys.argv) > 4 else ["node_modules", ".env", "logs", ".git"]
        upload_dir(os.path.abspath(sys.argv[2]), sys.argv[3], set(ex))
    else:
        sys.exit("unknown mode")