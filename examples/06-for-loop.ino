// 06 - Ablauf steuern mit Schleifen: Zählschleife (for)
// Lernt: for-Schleifen mit festgelegter Anzahl

void setup() {
  Serial.begin(115200);
  Serial.println("=== for-Schleife (Zählschleife) ===");
}

void loop() {
  // Zähle von 1 bis 10
  for (int i = 1; i <= 10; i++) {
    Serial.print(i);
    Serial.print(" ");
  }
  Serial.println();
  
  // Rückwärts zählen
  for (int i = 5; i >= 1; i--) {
    Serial.print(i);
    Serial.print(" ");
  }
  Serial.println();
  
  // In 2er Schritten
  for (int i = 0; i <= 10; i += 2) {
    Serial.print(i);
    Serial.print(" ");
  }
  Serial.println();
  
  delay(10000);
}
