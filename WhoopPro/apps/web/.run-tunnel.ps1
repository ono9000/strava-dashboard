$log = "C:\Users\onofr\WhoopPro\apps\web\.tunnel.log"
if (Test-Path $log) {
  Remove-Item $log -Force
}

& "C:\Windows\System32\OpenSSH\ssh.exe" `
  -o StrictHostKeyChecking=no `
  -o UserKnownHostsFile=NUL `
  -o ServerAliveInterval=60 `
  -R 80:localhost:3000 `
  nokey@localhost.run 2>&1 | Tee-Object -FilePath $log -Append
