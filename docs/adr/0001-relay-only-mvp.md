# MVP 正式连接仅支持 Paseo Relay

Rabbit R1 Creation 从 HTTPS origin 运行，而 Direct/LAN 连接还要求用户正确配置 TLS、Host allowlist、CORS 与密码认证。首版正式产品只通过现有 Paseo Relay 建立端到端加密连接，避免开放 daemon 端口并复用既有 pairing offer；Direct/LAN 只保留为受控开发调试路径，除非后续真实设备验证证明需要扩大正式支持范围。
