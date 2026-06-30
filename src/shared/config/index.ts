export interface Config {
  db: {
    url: string;
  };
  jwt: {
    secret: string;
  };
  app: {
    port: number;
  };
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("Configuration Error: DATABASE_URL environment variable is required.");
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("Configuration Error: JWT_SECRET environment variable is required.");
}

export const config: Config = {
  db: {
    url: dbUrl,
  },
  jwt: {
    secret: jwtSecret,
  },
  app: {
    port: Number(process.env.PORT || 3000),
  },
};
