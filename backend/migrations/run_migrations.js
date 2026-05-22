const isMain = require.main === module;

module.exports = (async () => {
  const db = require("../utils/db");
  try {
    // users
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        is_approved TINYINT(1) NOT NULL DEFAULT 1,
        is_blocked TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.execute(`
      ALTER TABLE users
      MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'
    `);

    const [phoneColRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'phone'`
    );
    if (!phoneColRows[0].count) {
      await db.execute(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER name`);
    }

    const [userEmailColRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'email'`
    );
    if (userEmailColRows[0].count) {
      await db.execute(
        `UPDATE users
         SET phone = email
         WHERE (phone IS NULL OR phone = '') AND email IS NOT NULL AND email != ''`
      );
    }

    const [phoneIdxRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND INDEX_NAME = 'uniq_users_phone'`
    );
    if (!phoneIdxRows[0].count) {
      await db.execute(`ALTER TABLE users ADD UNIQUE INDEX uniq_users_phone (phone)`);
    }

    const [approvalColRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'is_approved'`
    );
    if (!approvalColRows[0].count) {
      await db.execute(`ALTER TABLE users ADD COLUMN is_approved TINYINT(1) NOT NULL DEFAULT 1 AFTER role`);
    }

    const [blockedColRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'is_blocked'`
    );
    if (!blockedColRows[0].count) {
      await db.execute(`ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0 AFTER is_approved`);
    }

    // members
    await db.execute(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        photo_url LONGTEXT,
        address TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const [memberPhotoRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'members'
         AND COLUMN_NAME = 'photo_url'`
    );
    if (!memberPhotoRows[0].count) {
      await db.execute(`ALTER TABLE members ADD COLUMN photo_url LONGTEXT AFTER phone`);
    }

    const [memberGenderRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'members'
         AND COLUMN_NAME = 'gender'`
    );
    if (!memberGenderRows[0].count) {
      await db.execute(`ALTER TABLE members ADD COLUMN gender VARCHAR(20) AFTER name`);
    }

    const [memberDepartmentRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'members'
         AND COLUMN_NAME = 'department'`
    );
    if (!memberDepartmentRows[0].count) {
      await db.execute(`ALTER TABLE members ADD COLUMN department TEXT AFTER gender`);
    }
    await db.execute(`ALTER TABLE members MODIFY COLUMN department TEXT NULL`);

    const [memberAttendanceCodeRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'members'
         AND COLUMN_NAME = 'attendance_code'`
    );
    if (!memberAttendanceCodeRows[0].count) {
      await db.execute(`ALTER TABLE members ADD COLUMN attendance_code VARCHAR(64) NULL AFTER phone`);
    }

    const [memberAttendanceCodeIndexRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'members'
         AND INDEX_NAME = 'uniq_members_attendance_code'`
    );
    if (!memberAttendanceCodeIndexRows[0].count) {
      await db.execute(`ALTER TABLE members ADD UNIQUE INDEX uniq_members_attendance_code (attendance_code)`);
    }

    await db.execute(`
      UPDATE members
      SET attendance_code = CONCAT('CHM-', LPAD(id, 6, '0'))
      WHERE attendance_code IS NULL OR attendance_code = ''
    `);

    // events
    await db.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATETIME,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // donations
    await db.execute(`
      CREATE TABLE IF NOT EXISTS donations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donor_name VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        donation_date DATETIME,
        contribution_type VARCHAR(100) DEFAULT 'general',
        payment_method VARCHAR(50) DEFAULT 'manual',
        payment_reference VARCHAR(255),
        created_by INT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [donationTypeRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'donations'
         AND COLUMN_NAME = 'contribution_type'`
    );
    if (!donationTypeRows[0].count) {
      await db.execute(`ALTER TABLE donations ADD COLUMN contribution_type VARCHAR(100) DEFAULT 'general' AFTER donation_date`);
    }

    const [donationMethodRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'donations'
         AND COLUMN_NAME = 'payment_method'`
    );
    if (!donationMethodRows[0].count) {
      await db.execute(`ALTER TABLE donations ADD COLUMN payment_method VARCHAR(50) DEFAULT 'manual' AFTER contribution_type`);
    }

    const [donationRefRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'donations'
         AND COLUMN_NAME = 'payment_reference'`
    );
    if (!donationRefRows[0].count) {
      await db.execute(`ALTER TABLE donations ADD COLUMN payment_reference VARCHAR(255) NULL AFTER payment_method`);
    }

    // attendance
    await db.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        check_in DATETIME,
        check_out DATETIME,
        attendance_source VARCHAR(30) NOT NULL DEFAULT 'manual',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [attendanceSourceRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'attendance'
         AND COLUMN_NAME = 'attendance_source'`
    );
    if (!attendanceSourceRows[0].count) {
      await db.execute(`ALTER TABLE attendance ADD COLUMN attendance_source VARCHAR(30) NOT NULL DEFAULT 'manual' AFTER check_out`);
    }

    // announcements
    await db.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // weekly programs
    await db.execute(`
      CREATE TABLE IF NOT EXISTS weekly_programs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        day_of_week VARCHAR(30) NOT NULL,
        program_name VARCHAR(255) NOT NULL,
        time_slot VARCHAR(100) NOT NULL,
        venue VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 99,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // worship songs
    await db.execute(`
      CREATE TABLE IF NOT EXISTS worship_song_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_name VARCHAR(255) NOT NULL,
        service_date DATE NOT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_worship_song_folder_service_date (service_date),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS worship_songs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255),
        description TEXT,
        folder_id INT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_data LONGTEXT NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES worship_song_folders(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [folderIdRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'worship_songs'
         AND COLUMN_NAME = 'folder_id'`
    );
    if (!folderIdRows[0].count) {
      await db.execute(`ALTER TABLE worship_songs ADD COLUMN folder_id INT NULL AFTER description`);
    }

    const [folderDateIndexRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'worship_song_folders'
         AND INDEX_NAME = 'uniq_worship_song_folder_service_date'`
    );
    if (!folderDateIndexRows[0].count) {
      await db.execute(`ALTER TABLE worship_song_folders ADD UNIQUE INDEX uniq_worship_song_folder_service_date (service_date)`);
    }

    const [folderFkRows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'worship_songs'
         AND COLUMN_NAME = 'folder_id'
         AND REFERENCED_TABLE_NAME = 'worship_song_folders'`
    );
    if (!folderFkRows[0].count) {
      await db.execute(`
        ALTER TABLE worship_songs
        ADD CONSTRAINT fk_worship_songs_folder
        FOREIGN KEY (folder_id) REFERENCES worship_song_folders(id) ON DELETE SET NULL
      `);
    }

    // church album
    await db.execute(`
      CREATE TABLE IF NOT EXISTS church_album (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_name VARCHAR(255) NOT NULL,
        image_data LONGTEXT NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // payment transactions
    await db.execute(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        donation_id INT NULL,
        donor_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NULL,
        amount DECIMAL(10,2) NOT NULL,
        contribution_type VARCHAR(100) NOT NULL DEFAULT 'general',
        description TEXT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        provider_request_id VARCHAR(255) NULL,
        provider_checkout_id VARCHAR(255) NULL,
        provider_reference VARCHAR(255) NULL,
        redirect_url TEXT NULL,
        external_reference VARCHAR(255) NULL,
        provider_payload LONGTEXT NULL,
        response_message TEXT NULL,
        paid_at DATETIME NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Legacy-safe backfills for created_at in older schemas
    const createdAtTargets = ["events", "donations", "attendance"];
    for (const table of createdAtTargets) {
      const [rows] = await db.execute(
        `SELECT COUNT(*) as count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = 'created_at'`,
        [table]
      );
      if (!rows[0].count) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      }
    }

    const [weeklyRows] = await db.execute(`SELECT COUNT(*) as count FROM weekly_programs`);
    if (!weeklyRows[0].count) {
      await db.execute(`
        INSERT INTO weekly_programs (day_of_week, program_name, time_slot, venue, sort_order)
        VALUES
          ('Monday', 'Prayer Service', '6:00 PM - 7:30 PM', 'Main Sanctuary', 1),
          ('Tuesday', 'Bible Study', '6:00 PM - 7:30 PM', 'Fellowship Hall', 2),
          ('Wednesday', 'Youth Fellowship', '5:30 PM - 7:30 PM', 'Youth Chapel', 3),
          ('Thursday', 'Intercessory Prayers', '6:00 PM - 7:30 PM', 'Main Sanctuary', 4),
          ('Friday', 'Kesha / Night Vigil', '9:00 PM - 12:30 AM', 'Main Sanctuary', 5),
          ('Saturday', 'Choir Practice', '2:00 PM - 4:00 PM', 'Music Room', 6),
          ('Sunday', 'Main Service', '8:00 AM - 12:30 PM', 'Main Altar', 7)
      `);
    }

    console.log("Migrations executed (tables ensured)");
  } catch (e) {
    console.error("Migration error:", e.message);
    throw e;
  } finally {
    if (isMain) {
      await db.end().catch(() => {});
    }
  }
})();
