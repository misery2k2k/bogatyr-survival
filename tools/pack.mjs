// Упаковывает сборку в zip (index.html в корне, пути через "/").
// node tools/pack.mjs                                   — dist/ → bogatyr-yandex.zip
// node tools/pack.mjs dist-cg bogatyr-crazygames.zip    — сборка для CrazyGames
// Свой мини-zip, потому что Compress-Archive в PowerShell 5.1 пишет пути с "\".
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, process.argv[2] ?? 'dist');
const outFile = path.join(root, process.argv[3] ?? 'bogatyr-yandex.zip');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(path.relative(root, dist) + '/index.html не найден — сначала соберите игру');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dist).sort();
const locals = [];
const centrals = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(path.relative(dist, file).split(path.sep).join('/'), 'utf8');
  const data = fs.readFileSync(file);
  const crc = zlib.crc32(data);
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const method = useDeflate ? 8 : 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10); // time
  local.writeUInt16LE(0x21, 12); // date 1980-01-01
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + body.length;
}

const centralSize = centrals.reduce((s, b) => s + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

fs.writeFileSync(outFile, Buffer.concat([...locals, ...centrals, end]));
console.log(`${path.basename(outFile)}: ${files.length} файлов, ${(fs.statSync(outFile).size / 1024).toFixed(0)} КБ`);
