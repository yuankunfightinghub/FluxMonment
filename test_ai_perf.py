import time
import requests
import json

api_key = "sk-3f14ce9f36b74b65952a0d64d5477b25"
headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
content = "这是一个十个字的性能测试数据"

print("--- 开始测试大模型底层 API 耗时 ---")
t0 = time.time()
res1 = requests.post(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    headers=headers,
    json={
        "model": "qwen-plus",
        "messages": [{"role": "system", "content": "You are an intent parser bot."}, {"role": "user", "content": content}],
        "temperature": 0.1
    }
)
t1 = time.time()
print(f"1. detectUserIntent (首次 LLM 调用) 耗时: {(t1 - t0)*1000:.2f} ms")

t2 = time.time()
res2 = requests.post(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    headers=headers,
    json={
        "model": "qwen-plus",
        "messages": [{"role": "system", "content": "Extract tags, avatar, mood..."}, {"role": "user", "content": content}],
        "temperature": 0.3
    }
)
t3 = time.time()
print(f"2. llmAnalysis (第二次 LLM 解析) 耗时: {(t3 - t2)*1000:.2f} ms")

t4 = time.time()
res3 = requests.post(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
    headers=headers,
    json={
        "model": "text-embedding-v3",
        "input": content,
        "encoding_format": "float"
    }
)
t5 = time.time()
print(f"3. generateEmbedding (向量生成) 耗时: {(t5 - t4)*1000:.2f} ms")

print(f"=== 串行调用总计阻塞时间: {((t1-t0)+(t3-t2)+(t5-t4))*1000:.2f} ms ===")
