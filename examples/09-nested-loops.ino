// 09 - Verschachtelte Schleifen
// Lernt: for-Schleifen innerhalb von for-Schleifen

void setup() {
  Serial.begin(115200);
  Serial.println("=== Verschachtelte Schleifen ===");
}

void loop() {
  // Multiplikationstabelle 3x3
  for (int i = 1; i <= 3; i++) {
    for (int j = 1; j <= 3; j++) {
      Serial.print(i * j);
      Serial.print(" ");
    }
    Serial.println();
  }
  
  Serial.println();
  
  // Pyramide aus Sternchen
  for (int reihe = 1; reihe <= 5; reihe++) {
    for (int stern = 0; stern < reihe; stern++) {
      Serial.print("* ");
    }
    Serial.println();
  }
  
  Serial.println();
  
  delay(10000);
}
