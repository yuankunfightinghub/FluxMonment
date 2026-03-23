import time
import requests

api_key = "sk-3f14ce9f36b74b65952a0d64d5477b25"
headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
content = "这是一个十个字的性能测试数据"

print("--- 优化后新架构大模型 API 耗时评测 ---")
t0 = time.time()
res1 = requests.post(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    headers=headers,
    json={
        "model": "qwen-plus",
        "messages": [
            {"role": "system", "content": "你是一个超级中枢大脑，负责在判定查询意图或记录的同时完成所有卡片信息的提取封装。"},
            {"role": "user", "content": content}
        ],
        "temperature": 0.1
    }
)
t1 = time.time()
print(f"1. Unified detectUserIntent (二合一提取调用) 耗时: {(t1 - t0)*1000:.2f} ms")

print(f"=== 新架构执行完毕，目前串行卡顿 UI 的总时间: {(t1 - t0)*1000:.2f} ms ===")

t2 = time.time()
res3 = requests.post(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
    headers=headers,
    json={
        "model": "text-embedding-v3",
        "input": content,
        "encoding_format": "float"
    }
)
t3 = time.time()
print(f"3. 异步后台触发的 generateEmbedding (偷偷打向量) 耗时: {(t3 - t2)*1000:.2f} ms (该耗时已从主流程解耦)")
