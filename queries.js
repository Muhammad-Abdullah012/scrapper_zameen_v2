const createTable = () => {
    pool.query(`CREATE TABLE property_v2 (
      id SERIAL PRIMARY KEY,
      desc TEXT,
      header TEXT,
      type VARCHAR(255),
      price double precision,
      location VARCHAR(255),
      bath VARCHAR(255),
      area VARCHAR(255),
      purpose VARCHAR(255),
      bedroom VARCHAR(255),
      added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      initial_amount VARCHAR(255) NULL,
      monthly_installment VARCHAR(255) NULL,
      remaining_installments VARCHAR(255) NULL,
      url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`, (err, res) => {
        if (err) {
          console.error('error creating table:', err);
          return;
        }
        console.log('table created');
      });      
}

module.exports = { createTable }
