# Stop is conditional on the turn the user confirmed

An Agent session may finish one turn and start another while an R1 confirmation or reconnect is in progress, so cancel-by-agent can stop work the user never saw. A releasable Stop command carries `agentSessionId`, stable `targetTurnId` or generation, and `commandId`; the server atomically rejects a changed target, and success must identify completion of that same turn. If Paseo cannot provide stable turn identity and conditional cancellation, Follow-up may ship but Stop does not.
