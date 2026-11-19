const U=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
const T=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
async function r(c){const x=await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)});const j=await x.json();if(j.error)throw new Error(j.error);return j.result}
const s=(v,n)=>String(v==null?'':v).slice(0,n);
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
    if(!U||!T)return res.status(500).json({error:'storage'});
    if(req.method==='POST'){
      const ip=s((req.headers['x-forwarded-for']||'x').split(',')[0],64),k='rl:'+ip;
      const n=await r(['INCR',k]);if(n===1)await r(['EXPIRE',k,3600]);
      if(n>20)return res.status(429).json({error:'rate'});
      const b=req.body||{};
      if(!b.nom||!b.tel||!b.date||!b.heure)return res.status(400).json({error:'invalid'});
      const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      const o={id,t:Date.now(),status:'new',type:b.type==='order'?'order':'resa',nom:s(b.nom,60),tel:s(b.tel,25),date:s(b.date,10),heure:s(b.heure,5),note:s(b.note,300),text:s(b.text,3000),total:Math.round(Number(b.total)*100)/100||0};
      await r(['HSET','orders',id,JSON.stringify(o)]);
      return res.status(200).json({ok:true});
    }
    if(!process.env.ADMIN_PASSWORD||req.headers['x-admin-password']!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'auth'});
    if(req.method==='GET'){
      const a=(await r(['HGETALL','orders']))||[],L=[];
      for(let i=1;i<a.length;i+=2)L.push(JSON.parse(a[i]));
      L.sort((x,y)=>y.t-x.t);
      return res.status(200).json(L.slice(0,300));
    }
    if(req.method==='PATCH'){
      const{id,status}=req.body||{};
      if(!['new','confirmed','done','cancelled'].includes(status))return res.status(400).json({error:'invalid'});
      const v=await r(['HGET','orders',s(id,30)]);
      if(!v)return res.status(404).json({error:'notfound'});
      const o=JSON.parse(v);o.status=status;
      await r(['HSET','orders',o.id,JSON.stringify(o)]);
      return res.status(200).json({ok:true});
    }
    res.status(405).json({error:'method'});
  }catch(e){res.status(500).json({error:'server'})}
};
