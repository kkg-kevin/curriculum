require('dotenv').config();
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('./src/config/env');
const knex = require('./src/config/db');
(async () => {
  const user = await knex('users').where({ id: '89c72520-a7d7-4370-8191-bdf8f7c1f4ee' }).first();
  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  console.log('TOKEN_START:' + token + ':TOKEN_END');
  await knex.destroy();
})();
