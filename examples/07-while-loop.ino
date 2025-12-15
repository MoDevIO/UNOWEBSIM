// 07 - Ablauf steuern mit Schleifen: Kopfgesteuerte Schleife (while)
// Lernt: while-Schleifen (Bedingung wird am Anfang geprüft)

void setup() {
  Serial.begin(115200);
  Serial.println("=== while-Schleife (kopfgesteuert) ===");
}

void loop() {
  int zaehler = 1;
  
  while (zaehler <= 5) {
    Serial.print(zaehler);
    Serial.print(" ");
    zaehler++;
  }
  Serial.println();
  
  delay(10000);
}
