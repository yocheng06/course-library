// A small-image storage adapter for the standalone D1-only deployment.
// Image visibility remains enforced by the original /api/image route.
export const imageTableSql='CREATE TABLE IF NOT EXISTS image_objects (key TEXT PRIMARY KEY NOT NULL, body BLOB NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, created_at INTEGER NOT NULL)';
const initialized=new WeakSet();
function validKey(key){if(!/^submissions\/[0-9a-f-]{36}\/(?:[0-9]|[1-9][0-9]|1[0-9]{2})-[01]$/.test(key))throw Error('Invalid image key');}
function bytesOf(value){
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  if(Array.isArray(value))return Uint8Array.from(value);
  throw Error('Unsupported image bytes');
}
async function ready(DB){if(!initialized.has(DB)){await DB.prepare(imageTableSql).run();initialized.add(DB);}}
export function createD1ImageStore(DB){
  return {
    async get(key){validKey(key);await ready(DB);const row=await DB.prepare('SELECT body,content_type FROM image_objects WHERE key=?').bind(key).first();if(!row)return null;return {body:bytesOf(row.body),httpMetadata:{contentType:row.content_type}};},
    async put(key,value,options={}){
      validKey(key);const bytes=bytesOf(value);
      if(!bytes.length||bytes.length>1024*1024)throw Error('Image must be between 1 byte and 1 MB');
      const type=options.httpMetadata?.contentType;
      if(!['image/png','image/jpeg','image/webp'].includes(type))throw Error('Invalid image type');
      const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      await ready(DB);
      await DB.prepare('INSERT INTO image_objects(key,body,content_type,size,sha256,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,content_type=excluded.content_type,size=excluded.size,sha256=excluded.sha256,created_at=excluded.created_at')
        .bind(key,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),type,bytes.length,sha256,Date.now()).run();
    },
    async delete(key){validKey(key);await ready(DB);await DB.prepare('DELETE FROM image_objects WHERE key=?').bind(key).run();},
  };
}
