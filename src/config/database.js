import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const password = process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres';

/** اتصال PostgreSQL المُدار (DigitalOcean وغيره) يتطلب SSL غالباً — عيّن DB_SSL=true */
function sslDialectOptions() {
  const explicit = process.env.DB_SSL === 'true';
  const fromUrl =
    process.env.DATABASE_URL &&
    /sslmode=require|ssl=true/i.test(process.env.DATABASE_URL);
  if (explicit || fromUrl) {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
      }
    };
  }
  return {};
}

function buildSequelize() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    return new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: sslDialectOptions(),
      pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true
      }
    });
  }

  return new Sequelize(
    process.env.DB_NAME || 'atheer_switch',
    process.env.DB_USER || 'postgres',
    password,
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      logging: false,
      dialectOptions: sslDialectOptions(),
      pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true
      }
    }
  );
}

const sequelize = buildSequelize();

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح.');
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', error.message);
    process.exit(1);
  }
};

export default sequelize;
