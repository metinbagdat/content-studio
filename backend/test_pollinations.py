import requests
import urllib.parse
import os

print("🚀 Pollinations.ai Görsel Üretim Testi Başlatılıyor...\n")

prompt = "A futuristic educational AI robot helping a student, digital art, highly detailed, 8k resolution, vibrant colors"
safe_prompt = urllib.parse.quote(prompt)

# Doğrudan tarayıcıda da açabileceğiniz URL
image_url = f"https://image.pollinations.ai/prompt/{safe_prompt}?width=1024&height=1024&nologo=true&seed=42"

print(f"İstek URL'si: {image_url}\n")
print("Görsel indiriliyor, lütfen bekleyin (10-15 saniye sürebilir)...")

try:
    response = requests.get(image_url, timeout=30)
    response.raise_for_status()
    
    # Görseli mevcut klasöre kaydet
    filepath = os.path.join(os.path.dirname(__file__), "test_image.png")
    with open(filepath, "wb") as f:
        f.write(response.content)
        
    print("\n✅ BAŞARILI!")
    print(f"Görsel şuraya kaydedildi: {filepath}")
    print("👉 Bu dosyaya çift tıklayarak görseli hemen görebilirsiniz.")
    
except requests.exceptions.RequestException as e:
    print(f"\n❌ HATA: Görsel indirilemedi.")
    print(f"Hata Detayı: {e}")