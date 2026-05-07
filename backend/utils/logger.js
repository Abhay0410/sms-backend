import winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  // In production, only log warnings and errors to save CPU cycles
  // In development, log everything (debug and above)
  level: isProd ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    isProd 
      ? winston.format.json() 
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
            return `[${timestamp}] ${level}: ${message} ${metaString}`;
          })
        )
  ),
  transports: [new winston.transports.Console()],
});

export default logger;