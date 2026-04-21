import json
import os
import sys


def _get_required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError("MissingConfig")
    return value


def get_state() -> str:
    try:
        router_ip = _get_required_env("ROUTER_IP")
        router_username = _get_required_env("ROUTER_USERNAME")
        router_password = _get_required_env("ROUTER_PASSWORD")

        import paramiko

        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(router_ip, 22, router_username, router_password, timeout=10)
        _, stdout, _ = ssh.exec_command("ubus call network.interface.wan status")
        data = json.loads(stdout.read().decode())
        return data["ipv4-address"][0]["address"]
    except ValueError as error:
        return f"STATE_ERROR: {error}"
    except ModuleNotFoundError as error:
        return f"STATE_ERROR: {type(error).__name__}"
    except Exception as error:
        return f"STATE_ERROR: {type(error).__name__}"
    finally:
        ssh = locals().get("ssh")
        if ssh is not None:
            ssh.close()


if __name__ == "__main__":
    sys.stdout.write(get_state())
