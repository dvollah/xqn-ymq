/**
 * ymq-api — 羽毛球记录云函数
 * 
 * HTTP 端点: https://ymq-d1g1qdr0d4028ee0b.ap-shanghai.app.tcloudbase.com/ymq-api
 * 
 * 路由:
 *   GET    /players           — 获取所有球员
 *   POST   /players           — 添加球员 { name, gender }
 *   PUT    /players/:id       — 更新球员
 *   DELETE /players/:id       — 删除球员
 *   GET    /matches           — 获取所有比赛（按 createdAt 降序）
 *   POST   /matches           — 添加比赛
 *   PUT    /matches/:id       — 更新比赛（不含 _id 字段）
 *   DELETE /matches/:id       — 删除比赛
 *   GET    /pending           — 获取待审核比赛
 *   POST   /pending           — 添加待审核比赛
 *   DELETE /pending/:id       — 删除待审核比赛
 */

const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: 'ymq-d1g1qdr0d4028ee0b'
});

const db = app.database();
const COL_PLAYERS = 'players';
const COL_MATCHES = 'matches';
const COL_PENDING = 'pending_matches';

// CORS 响应
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function ok(data) {
  return { code: 0, data };
}

function fail(msg, code) {
  return { code: code || -1, msg };
}

exports.main = async (event, context) => {
  const { httpMethod, path, body, headers } = event;

  // 处理 CORS 预检
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  // 路径格式: /players 或 /players/xxx
  const parts = path.replace(/^\/+|\/+$/g, '').split('/');
  const resource = parts[0];
  const id = parts[1];

  let data = {};
  try {
    if (body && typeof body === 'string') {
      data = JSON.parse(body);
    } else if (body && typeof body === 'object') {
      data = body;
    }
  } catch (e) {
    return fail('请求体 JSON 解析失败');
  }

  try {
    switch (resource) {
      // ==================== Players ====================
      case 'players':
        if (httpMethod === 'GET') {
          const res = await db.collection(COL_PLAYERS).limit(1000).get();
          return ok(res.data || []);
        }
        if (httpMethod === 'POST') {
          if (!data.name) return fail('缺少 name 字段');
          const player = {
            id: data.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
            name: (data.name || '').trim(),
            gender: data.gender || '男',
            createdAt: Date.now()
          };
          const res = await db.collection(COL_PLAYERS).add(player);
          return ok({ ...player, _id: res.id });
        }
        if (httpMethod === 'PUT' && id) {
          const updateData = {};
          if (data.name !== undefined) updateData.name = (data.name || '').trim();
          if (data.gender !== undefined) updateData.gender = data.gender;
          if (Object.keys(updateData).length === 0) return fail('无有效更新字段');
          await db.collection(COL_PLAYERS).doc(id).update(updateData);
          return ok({ updated: id });
        }
        if (httpMethod === 'DELETE' && id) {
          await db.collection(COL_PLAYERS).doc(id).remove();
          return ok({ deleted: id });
        }
        break;

      // ==================== Matches ====================
      case 'matches':
        if (httpMethod === 'GET') {
          const res = await db.collection(COL_MATCHES).orderBy('createdAt', 'desc').limit(1000).get();
          return ok(res.data || []);
        }
        if (httpMethod === 'POST') {
          const match = { ...data, createdAt: data.createdAt || Date.now() };
          delete match._id;
          const res = await db.collection(COL_MATCHES).add(match);
          return ok({ ...match, _id: res.id });
        }
        if (httpMethod === 'PUT' && id) {
          const { _id, ...updateData } = data;
          await db.collection(COL_MATCHES).doc(id).update(updateData);
          return ok({ updated: id });
        }
        if (httpMethod === 'DELETE' && id) {
          await db.collection(COL_MATCHES).doc(id).remove();
          return ok({ deleted: id });
        }
        break;

      // ==================== Pending ====================
      case 'pending':
        if (httpMethod === 'GET') {
          const res = await db.collection(COL_PENDING).orderBy('createdAt', 'desc').limit(1000).get();
          return ok(res.data || []);
        }
        if (httpMethod === 'POST') {
          const match = { ...data, createdAt: data.createdAt || Date.now() };
          delete match._id;
          const res = await db.collection(COL_PENDING).add(match);
          return ok({ ...match, _id: res.id });
        }
        if (httpMethod === 'DELETE' && id) {
          await db.collection(COL_PENDING).doc(id).remove();
          return ok({ deleted: id });
        }
        break;

      default:
        return fail('未知资源: ' + resource, 404);
    }
  } catch (err) {
    console.error('云函数错误:', err);
    return fail(err.message || '服务器内部错误', 500);
  }

  return fail('不支持的请求: ' + httpMethod + ' ' + path, 405);
};
