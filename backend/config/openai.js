const OpenAI = require('openai');

// 从环境变量或配置文件加载API密钥
// 实际部署时应使用环境变量，避免硬编码密钥
const apiKey = process.env.OPENAI_API_KEY || 'your-api-key-here';

if (!apiKey || apiKey === 'your-api-key-here') {
  console.warn('OpenAI API密钥未配置，请设置OPENAI_API_KEY环境变量');
}

// 创建OpenAI客户端实例
const openai = new OpenAI({
  apiKey: apiKey
});

module.exports = openai;