export const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  exists: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  flushdb: jest.fn(),
  quit: jest.fn(),
}

export const redisClient = redisMock