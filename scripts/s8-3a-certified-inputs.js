import fs from 'node:fs';
import crypto from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
export const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export const blob=b=>crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
export function exactBytes(path,expectedBlob,expectedHash){
  const b=fs.readFileSync(path);
  if(expectedBlob && blob(b)!==expectedBlob)throw Error('SOURCE_BLOB_MISMATCH:'+path);
  if(expectedHash && hash(b)!==expectedHash)throw Error('SOURCE_SHA256_MISMATCH:'+path);
  return b;
}
// Bounded ZIP reader: only stored/deflated, unencrypted entries from the pinned package.
export function unzip(bytes){
  let end=bytes.length-22;
  while(end>=Math.max(0,bytes.length-65557)&&bytes.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0)throw Error('ZIP_END_MISSING');
  const count=bytes.readUInt16LE(end+10),out=new Map();let p=bytes.readUInt32LE(end+16);
  for(let i=0;i<count;i++){
    if(bytes.readUInt32LE(p)!==0x02014b50)throw Error('ZIP_DIRECTORY_INVALID');
    const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),size=bytes.readUInt32LE(p+20),unpacked=bytes.readUInt32LE(p+24);
    const n=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42);
    const name=bytes.subarray(p+46,p+46+n).toString('utf8');
    if(flags&1||![0,8].includes(method)||out.has(name)||unpacked>10000000)throw Error('ZIP_ENTRY_REFUSED:'+name);
    if(bytes.readUInt32LE(offset)!==0x04034b50)throw Error('ZIP_LOCAL_INVALID');
    const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28),compressed=bytes.subarray(start,start+size);
    const value=method===8?inflateRawSync(compressed):compressed;
    if(value.length!==unpacked)throw Error('ZIP_SIZE_MISMATCH');
    out.set(name,value);p+=46+n+extra+comment;
  }
  return out;
}
