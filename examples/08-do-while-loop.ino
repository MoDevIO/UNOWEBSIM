// 08 - Ablauf steuern mit Schleifen: Fußgesteuerte Schleife (do-while)
// Lernt: do-while-Schleifen (Bedingung wird am Ende geprüft)

void setup() {
  Serial.begin(115200);
  Serial.println("=== do-while-Schleife (fußgesteuert) ===");
}

void loop() {
  int zaehler = 1;
  
  do {
    Serial.print(zaehler);
    Serial.print(" ");
    zaehler++;
  } while (zaehler <= 5);
  
  Serial.println();
  
  delay(10000);
}
