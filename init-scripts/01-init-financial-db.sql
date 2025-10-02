-- Financial App Database Initialization Script
-- This runs in the separate financial database

-- Set timezone
SET timezone = 'Asia/Bahrain';

-- Create financial tables in the financial_app database
CREATE TABLE IF NOT EXISTS transactions (
    sn SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    time TIME,
    merchant VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'BHD',
    category VARCHAR(100),
    tag VARCHAR(100),
    name VARCHAR(255),
    card_ending VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    category VARCHAR(100) NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, category)
);

-- Insert default categories with colors matching the app theme
INSERT INTO categories (name, color) VALUES
('Food & Dining', '#FF6B6B'),
('Transportation', '#4ECDC4'),
('Shopping', '#45B7D1'),
('Entertainment', '#96CEB4'),
('Bills & Utilities', '#FFEAA7'),
('Healthcare', '#DDA0DD'),
('Education', '#98D8C8'),
('Travel', '#F7DC6F'),
('Groceries', '#BB8FCE'),
('Gas', '#85C1E9'),
('Other', '#D5DBDB')
ON CONFLICT (name) DO NOTHING;

-- Insert sample transactions for testing (using Bahrain context)
INSERT INTO transactions (date, time, merchant, amount, currency, category, tag, name, card_ending) VALUES
(CURRENT_DATE - INTERVAL '5 days', '14:30:00', 'Starbucks City Centre', 2.100, 'BHD', 'Food & Dining', 'coffee', 'Coffee', '1234'),
(CURRENT_DATE - INTERVAL '4 days', '09:15:00', 'ENOC Petrol Station', 15.000, 'BHD', 'Gas', 'fuel', 'Gas Fill-up', '1234'),
(CURRENT_DATE - INTERVAL '3 days', '16:45:00', 'Lulu Hypermarket', 25.750, 'BHD', 'Groceries', 'weekly-shop', 'Grocery Shopping', '5678'),
(CURRENT_DATE - INTERVAL '2 days', '11:20:00', 'Netflix', 3.500, 'BHD', 'Entertainment', 'streaming', 'Subscription', '1234'),
(CURRENT_DATE - INTERVAL '1 day', '13:10:00', 'Careem', 4.200, 'BHD', 'Transportation', 'ride', 'Taxi Ride', '5678'),
(CURRENT_DATE, '10:00:00', 'Jasmis Restaurant', 8.500, 'BHD', 'Food & Dining', 'lunch', 'Lunch', '1234')
ON CONFLICT DO NOTHING;

-- Insert sample budget for current month (in BHD)
INSERT INTO budgets (month, category, target_amount) VALUES
(TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Food & Dining', 80.000),
(TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Transportation', 60.000),
(TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Groceries', 120.000),
(TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Entertainment', 40.000),
(TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Bills & Utilities', 100.000),
(TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Gas', 50.000)
ON CONFLICT (month, category) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$ language 'plpgsql';

-- Create trigger for transactions table
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW monthly_summary AS
SELECT 
    TO_CHAR(date, 'YYYY-MM') as month,
    category,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_amount
FROM transactions
GROUP BY TO_CHAR(date, 'YYYY-MM'), category
ORDER BY month DESC, total_amount DESC;

CREATE OR REPLACE VIEW daily_spending AS
SELECT 
    date,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count
FROM transactions
GROUP BY date
ORDER BY date DESC;

CREATE OR REPLACE VIEW top_merchants AS
SELECT 
    merchant,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    MAX(date) as last_transaction
FROM transactions
GROUP BY merchant
ORDER BY total_amount DESC;

-- Create a function to get monthly category summary
CREATE OR REPLACE FUNCTION get_monthly_category_summary(target_month VARCHAR(7))
RETURNS TABLE (
    category VARCHAR(100),
    total_amount DECIMAL(10,2),
    transaction_count BIGINT,
    budget_target DECIMAL(10,2),
    percentage_used DECIMAL(5,2)
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        t.category,
        COALESCE(SUM(t.amount), 0) as total_amount,
        COUNT(t.sn) as transaction_count,
        COALESCE(b.target_amount, 0) as budget_target,
        CASE 
            WHEN b.target_amount > 0 THEN 
                ROUND((COALESCE(SUM(t.amount), 0) / b.target_amount * 100), 2)
            ELSE 0 
        END as percentage_used
    FROM categories c
    LEFT JOIN transactions t ON c.name = t.category 
        AND TO_CHAR(t.date, 'YYYY-MM') = target_month
    LEFT JOIN budgets b ON c.name = b.category 
        AND b.month = target_month
    GROUP BY t.category, c.name, b.target_amount
    ORDER BY total_amount DESC NULLS LAST;
END;
$ LANGUAGE plpgsql;

-- Success message
SELECT 'Financial App database initialized successfully!' as status;