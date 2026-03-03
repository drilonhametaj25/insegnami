import Redis from 'ioredis';

// Get REDIS_URL lazily to avoid build-time errors
const getRedisUrl = () => process.env.REDIS_URL || '';

class RedisManager {
  private static instance: RedisManager;
  private client: Redis | null = null;

  private constructor() {
    // Lazy initialization - don't connect during build
  }

  private initClient() {
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL not configured, Redis operations will be skipped');
      return null;
    }

    if (!this.client) {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      this.client.on('error', (err: Error) => {
        console.error('❌ Redis connection error:', err);
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });
    }
    return this.client;
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public getClient(): Redis | null {
    return this.initClient();
  }

  // Get Redis connection config for BullMQ
  public getConnectionConfig(): any {
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
      // Return dummy config during build - won't be used
      return { host: 'localhost', port: 6379 };
    }
    // Extract connection details from REDIS_URL
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1)) || 0,
    };
  }

  // Cache operations
  async get(key: string): Promise<string | null> {
    const client = this.initClient();
    if (!client) return null;
    try {
      return await client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    const client = this.initClient();
    if (!client) return false;
    try {
      if (ttl) {
        await client.setex(key, ttl, value);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    const client = this.initClient();
    if (!client) return false;
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async getJSON(key: string): Promise<any> {
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<boolean> {
    return await this.set(key, JSON.stringify(value), ttl);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

export const redis = RedisManager.getInstance();
export default redis;
