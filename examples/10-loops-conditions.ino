// 10 - Verschachtelte Schleifen und Verzweigungen
// Lernt: for-Schleifen mit if/else Bedingungen kombiniert

void setup() {
  Serial.begin(115200);
  Serial.println("=== Schleifen + Verzweigungen ===");
}

void loop() {
  // Schachbrett-Muster (8x8)
  for (int reihe = 0; reihe < 8; reihe++) {
    for (int spalte = 0; spalte < 8; spalte++) {
      if ((reihe + spalte) % 2 == 0) {
        Serial.print("# ");
      } else {
        Serial.print("  ");
      }
    }
    Serial.println();
  }
  
  Serial.println();
  
  // Zahlen 1-10 kategorisieren
  for (int i = 1; i <= 10; i++) {
    Serial.print(i);
    Serial.print(" -> ");
    
    if (i % 2 == 0) {
      if (i < 5) {
        Serial.println("kleine gerade");
      } else {
        Serial.println("große gerade");
      }
    } else {
      if (i < 5) {
        Serial.println("kleine ungerade");
      } else {
        Serial.println("große ungerade");
      }
    }
  }
  
  Serial.println();
  
  delay(10000);
}
