/* Pure JSON manipulation helpers used by the editor and tests. */

export function deepClone(value){
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value){
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function pathKey(path){
  if(!Array.isArray(path) || path.length === 0) return "";
  return path
    .map(p => String(p)
      .replaceAll("~", "~0")
      .replaceAll("/", "~1"))
    .join("/");
}

export function getAtPath(root, path){
  let cur = root;
  for(const part of path){
    if(cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function setAtPath(root, path, value){
  if(path.length === 0){
    return value;
  }
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getAtPath(root, parentPath);
  if(parent == null){
    throw new Error("Cannot set path on null/undefined parent");
  }
  parent[key] = value;
  return root;
}

export function deleteAtPath(root, path){
  if(path.length === 0) throw new Error("Cannot delete root");
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getAtPath(root, parentPath);
  if(Array.isArray(parent)){
    const idx = Number(key);
    if(!Number.isInteger(idx)) throw new Error("Array delete expects numeric index");
    parent.splice(idx, 1);
    return root;
  }
  if(isPlainObject(parent)){
    delete parent[key];
    return root;
  }
  throw new Error("Cannot delete from non-container");
}

export function renameKey(root, path, newKey){
  if(path.length === 0) throw new Error("Cannot rename root");
  const parentPath = path.slice(0, -1);
  const oldKey = path[path.length - 1];
  const parent = getAtPath(root, parentPath);
  if(!isPlainObject(parent)) throw new Error("renameKey expects object parent");
  const nk = String(newKey || "").trim();
  if(!nk) throw new Error("New key must be non-empty");
  if(Object.prototype.hasOwnProperty.call(parent, nk)){
    throw new Error(`Key already exists: ${nk}`);
  }
  parent[nk] = parent[oldKey];
  delete parent[oldKey];
  return root;
}

export function moveArrayItem(root, path, direction){
  // path points to the array item itself.
  if(path.length === 0) throw new Error("Cannot move root");
  const parentPath = path.slice(0, -1);
  const idx = Number(path[path.length - 1]);
  const parent = getAtPath(root, parentPath);
  if(!Array.isArray(parent)) throw new Error("moveArrayItem expects array parent");
  if(!Number.isInteger(idx)) throw new Error("Array move expects numeric index");
  const next = direction === "up" ? idx - 1 : idx + 1;
  if(next < 0 || next >= parent.length) return root;
  const tmp = parent[idx];
  parent[idx] = parent[next];
  parent[next] = tmp;
  return root;
}

export function inferType(value){
  if(value === null) return "null";
  if(Array.isArray(value)) return "array";
  if(isPlainObject(value)) return "object";
  return typeof value;
}

export function coerceFromString(type, raw){
  const t = String(type);
  const r = raw == null ? "" : String(raw);
  if(t === "string") return r;
  if(t === "number"){
    const n = Number(r);
    if(Number.isFinite(n)) return n;
    return 0;
  }
  if(t === "boolean"){
    if(r.trim().toLowerCase() === "true") return true;
    if(r.trim().toLowerCase() === "false") return false;
    return false;
  }
  if(t === "null") return null;
  if(t === "object") return {};
  if(t === "array") return [];
  return r;
}

export function validatePaulipediaData(value){
  const errors = [];
  const warnings = [];

  if(!isPlainObject(value)){
    errors.push("Root must be a JSON object.");
    return {ok:false, errors, warnings};
  }

  const mustHave = ["site","article","person","infobox","sections","references","externalLinks"];
  for(const k of mustHave){
    if(!(k in value)) warnings.push(`Missing top-level key: ${k}`);
  }

  if("sections" in value && !Array.isArray(value.sections)){
    errors.push("sections must be an array.");
  }
  if("references" in value && !Array.isArray(value.references)){
    errors.push("references must be an array.");
  }
  if("externalLinks" in value && !Array.isArray(value.externalLinks)){
    errors.push("externalLinks must be an array.");
  }

  if("site" in value && !isPlainObject(value.site)) warnings.push("site should be an object.");
  if("article" in value && !isPlainObject(value.article)) warnings.push("article should be an object.");
  if("person" in value && !isPlainObject(value.person)) warnings.push("person should be an object.");
  if("infobox" in value && !isPlainObject(value.infobox)) warnings.push("infobox should be an object.");

  return {ok: errors.length === 0, errors, warnings};
}
