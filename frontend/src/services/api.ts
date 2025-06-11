import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 健康检查接口
export const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// 房间管理API

export const createRoom = async (playerName: string) => {
  try {
    const response = await api.post('/rooms', { playerName });
    return response.data;
  } catch (error) {
    console.error('创建房间失败:', error);
    throw error;
  }
};

export const joinRoom = async (roomId: string, playerName: string) => {
  try {
    const response = await api.post(`/rooms/${roomId}/join`, { playerName });
    return response.data;
  } catch (error) {
    console.error('加入房间失败:', error);
    throw error;
  }
};

export const getRoomPlayers = async (roomId: string) => {
  try {
    const response = await api.get(`/rooms/${roomId}/players`);
    return response.data.players;
  } catch (error) {
    console.error('获取房间玩家失败:', error);
    throw error;
  }
};

export default api;