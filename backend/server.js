// 1. 引入必要的库
const express = require('express');
const mysql = require('mysql2/promise'); // 使用 promise 版本的 mysql2
const cors = require('cors');
require('dotenv').config(); // 读取 .env 文件

// 2. 创建 Express 应用
const app = express();
app.use(cors()); // 允许前端跨域访问
app.use(express.json()); // 解析 JSON 格式的请求体

// 3. 创建数据库连接池 (Railway 会自动注入环境变量)
const pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    port: process.env.MYSQLPORT || 3306,
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'submission_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 4. 初始化数据库表（如果不存在）
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                author VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ 数据库表初始化完成（或已存在）');
    } catch (err) {
        console.error('❌ 数据库初始化失败:', err.message);
    }
}

// 5. 定义 API 接口

// 5.1 投稿提交接口
app.post('/api/submit', async (req, res) => {
    try {
        const { title, author, content } = req.body;
        if (!title || !author || !content) {
            return res.status(400).json({ error: '标题、作者和内容均为必填项' });
        }

        const [result] = await pool.query(
            'INSERT INTO submissions (title, author, content) VALUES (?, ?, ?)',
            [title, author, content]
        );
        res.json({ success: true, message: '投稿成功，请等待审核！', id: result.insertId });
    } catch (err) {
        console.error('投稿失败:', err);
        res.status(500).json({ error: '投稿失败，服务器内部错误' });
    }
});

// 5.2 管理员获取所有投稿接口
app.get('/api/admin/submissions', async (req, res) => {
    const password = req.query.password;
    // 简单密码验证，生产环境请使用更安全的方式
    if (password !== 'admin123') {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('获取投稿列表失败:', err);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 5.3 管理员更新稿件状态接口
app.post('/api/admin/update/:id', async (req, res) => {
    const { password, status } = req.body;
    const { id } = req.params;

    if (password !== 'admin123') {
        return res.status(401).json({ error: '密码错误' });
    }
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: '状态值无效' });
    }

    try {
        await pool.query('UPDATE submissions SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: '状态已更新' });
    } catch (err) {
        console.error('更新状态失败:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 6. 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 服务器已启动，运行在端口 ${PORT}`);
    await initDatabase(); // 启动时初始化数据库
});