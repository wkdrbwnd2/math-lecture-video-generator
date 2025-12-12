// 개발자 계정 생성 스크립트
// 사용법: node scripts/create-dev-account.js [username] [password]

const bcrypt = require('bcrypt');
const { db } = require('../db/config');

async function createDeveloperAccount(username, password) {
  try {
    const pool = db();
    
    // Check if user already exists
    const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (existing.length > 0) {
      console.log(`⚠️  User "${username}" already exists.`);
      console.log('Updating to developer account...');
      
      // Update existing user to developer
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Check if role column exists
      try {
        await pool.query('ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT NULL');
        console.log('✅ Added role column to users table');
      } catch (err) {
        // Column might already exist, ignore error
        if (!err.message.includes('Duplicate column name')) {
          throw err;
        }
      }
      
      await pool.query(
        'UPDATE users SET password = ?, role = ? WHERE username = ?',
        [hashedPassword, 'developer', username]
      );
      
      console.log(`✅ Updated user "${username}" to developer account`);
      console.log(`   Username: ${username}`);
      console.log(`   Role: developer`);
      return;
    }
    
    // Create new developer account
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if role column exists
    try {
      await pool.query('ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT NULL');
      console.log('✅ Added role column to users table');
    } catch (err) {
      // Column might already exist, ignore error
      if (!err.message.includes('Duplicate column name')) {
        throw err;
      }
    }
    
    await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'developer']
    );
    
    console.log(`✅ Created developer account:`);
    console.log(`   Username: ${username}`);
    console.log(`   Role: developer`);
    console.log(`\n📝 You can now login with:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('❌ Error creating developer account:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const username = args[0] || 'admin';
const password = args[1] || 'admin123';

console.log('🔧 Creating developer account...\n');
createDeveloperAccount(username, password);

