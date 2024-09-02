const express = require("express");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Create a write stream for logging to a file
const logDirectory = path.join(__dirname, "logs");

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Create a write stream in append mode for the log2000 file
const logStream = fs.createWriteStream(path.join(logDirectory, "log2000.log"), { flags: "a" });

// Use morgan to log requests to the log2000 file
app.use(morgan("combined", { stream: logStream }));

// Blocking IPs logic
const blockedIPsFilePath = path.join(logDirectory, 'blocked_ips.log');
const blocklist = new Set();

// Function to load blocked IPs
const loadBlockedIPs = () => {
  if (fs.existsSync(blockedIPsFilePath)) {
    const blockedIPs = fs.readFileSync(blockedIPsFilePath, 'utf8').split('\n').filter(Boolean);
    blockedIPs.forEach(ip => blocklist.add(ip));
  }
};

// Load blocked IPs initially and on file change
loadBlockedIPs();
fs.watchFile(blockedIPsFilePath, (curr, prev) => {
  blocklist.clear();
  loadBlockedIPs();
});

// Middleware to block requests from blocked IPs
app.use((req, res, next) => {
  const ip = req.ip;
  if (blocklist.has(ip)) {
    console.log(`Blocked IP tried to access: ${ip}`);
    return res.status(403).send('Access denied.');
  }
  next();
});

// Serve static files
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});
