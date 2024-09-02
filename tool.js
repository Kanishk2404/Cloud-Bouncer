const express = require('express');
const fs = require('fs');
const path = require('path');
const { RecaptchaV2 } = require('express-recaptcha');
const winston = require('winston');
const readline = require('readline');

const app = express();
const port = 2000;

// Initialize reCAPTCHA with your keys
const recaptcha = new RecaptchaV2('YOUR_SITE_KEY', 'YOUR_SECRET_KEY'); // Replace with your actual site key and secret key

// Rate Limiting Configuration
const rateLimitWindow = 30 * 1000; // 30 seconds
const requestThreshold = 10; // 10 requests
const logDirectory = path.join(__dirname, 'logs');
const logFilePath = path.join(logDirectory, 'log2000.log');
const blockedIPsFilePath = path.join(logDirectory, 'blocked_ips.log');
const ipRequestCounts = {};
const blockedIPs = new Set(); // Track blocked IPs in memory

// Setup logging with Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logDirectory, 'combined.log') })
  ]
});

// Ensure logs directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Function to analyze logs
const analyzeLogs = () => {
  const rl = readline.createInterface({
    input: fs.createReadStream(logFilePath),
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    const ip = line.match(/\d+\.\d+\.\d+\.\d+/); // Extract IP from log line
    if (ip) {
      const ipStr = ip[0];
      if (!ipRequestCounts[ipStr]) {
        ipRequestCounts[ipStr] = [];
      }
      ipRequestCounts[ipStr].push(new Date());

      // Remove old entries
      ipRequestCounts[ipStr] = ipRequestCounts[ipStr].filter(timestamp => new Date() - timestamp < rateLimitWindow);

      if (ipRequestCounts[ipStr].length > requestThreshold) {
        if (!blockedIPs.has(ipStr)) {
          fs.appendFileSync(blockedIPsFilePath, `${ipStr}\n`);
          blockedIPs.add(ipStr); // Add IP to in-memory blocked set
          logger.warn(`Blocked IP due to rate limit: ${ipStr}`);
        }
      }
    }
  });
};

// Periodically analyze logs
setInterval(analyzeLogs, 10 * 1000); // Analyze every 10 seconds

// CAPTCHA Route and Verification
app.get('/captcha', recaptcha.middleware.render, (req, res) => {
  res.send(`
    <form action="/verify-captcha" method="post">
      ${res.recaptcha}
      <button type="submit">Submit</button>
    </form>
  `);
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve tools.html at the /tool path
app.get('/tool', (req, res) => {
  res.sendFile(path.join(__dirname, 'tools.html'));
});

app.post('/verify-captcha', recaptcha.middleware.verify, (req, res) => {
  const ip = req.ip;
  if (!req.recaptcha.error) {
    logger.info('CAPTCHA passed');
    res.send('CAPTCHA passed, you are now whitelisted.');
  } else {
    logger.warn('CAPTCHA failed');
    if (!blockedIPs.has(ip)) {
      fs.appendFileSync(blockedIPsFilePath, `${ip}\n`);
      blockedIPs.add(ip); // Add IP to in-memory blocked set
    }
    res.send('CAPTCHA failed');
  }
});

// Start the Server
app.listen(port, () => {
  logger.info(`DDoS Protection Tool running on port ${port}`);
});
