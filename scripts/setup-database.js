// 데이터베이스 초기화 스크립트
// 사용법: node scripts/setup-database.js [root_password]
// root_password는 선택사항입니다. 제공하지 않으면 환경 변수나 기본값을 사용합니다.

const mysql = require('mysql2/promise');
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = require('../db/config');

async function setupDatabase(rootPassword = null) {
  let rootConnection;
  
  try {
    // Root 계정으로 연결 (데이터베이스 생성 및 사용자 생성용)
    const rootUser = 'root';
    const rootPass = rootPassword || process.env.MYSQL_ROOT_PASSWORD || '';
    
    console.log('🔌 Connecting to MySQL as root...');
    rootConnection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: rootUser,
      password: rootPass,
    });
    
    console.log('✅ Connected to MySQL');
    
    // 데이터베이스 생성
    console.log(`📦 Creating database "${DB_NAME}" if not exists...`);
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database "${DB_NAME}" ready`);
    
    // 사용자 생성 및 권한 부여
    console.log(`👤 Creating user "${DB_USER}" if not exists...`);
    
    // 사용자가 이미 존재하는지 확인
    const [users] = await rootConnection.query(
      `SELECT User FROM mysql.user WHERE User = ? AND Host = ?`,
      [DB_USER, 'localhost']
    );
    
    if (users.length === 0) {
      // 사용자 생성
      await rootConnection.query(
        `CREATE USER ?@'localhost' IDENTIFIED BY ?`,
        [DB_USER, DB_PASS]
      );
      console.log(`✅ User "${DB_USER}" created`);
    } else {
      console.log(`⚠️  User "${DB_USER}" already exists, updating password...`);
      await rootConnection.query(
        `ALTER USER ?@'localhost' IDENTIFIED BY ?`,
        [DB_USER, DB_PASS]
      );
      console.log(`✅ Password updated for user "${DB_USER}"`);
    }
    
    // 권한 부여
    console.log(`🔐 Granting privileges to "${DB_USER}"...`);
    await rootConnection.query(
      `GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO ?@'localhost'`,
      [DB_USER]
    );
    await rootConnection.query('FLUSH PRIVILEGES');
    console.log(`✅ Privileges granted`);
    
    // 데이터베이스에 연결하여 테이블 생성
    console.log(`🔌 Connecting to database "${DB_NAME}"...`);
    const dbConnection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
    });
    
    console.log('✅ Connected to database');
    
    // users 테이블 생성
    console.log('📋 Creating users table if not exists...');
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Users table ready');
    
    await dbConnection.end();
    console.log('\n🎉 Database setup completed successfully!');
    console.log(`\n📝 Database Information:`);
    console.log(`   Host: ${DB_HOST}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User: ${DB_USER}`);
    console.log(`   Password: ${DB_PASS}`);
    console.log(`\n✅ You can now access http://localhost:8000/admin/create-dev`);
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: If you need to provide root password, run:');
      console.error(`   node scripts/setup-database.js <root_password>`);
      console.error('   Or set MYSQL_ROOT_PASSWORD environment variable');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure MySQL server is running');
      console.error('   Windows: Check MySQL service in Services');
      console.error('   Or start MySQL: net start MySQL');
    }
    
    process.exit(1);
  } finally {
    if (rootConnection) {
      await rootConnection.end();
    }
  }
}

// 명령줄 인자 처리
const args = process.argv.slice(2);
const rootPassword = args[0] || null;

setupDatabase(rootPassword);

