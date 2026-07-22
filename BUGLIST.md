---
**22-07-2026**

#Supplements Tab:
die geloggten Supps werden ohne ihrem Namen angezeigt.
zwecks Daily Habit Checklist (also welches supp welche Tagesphase + push-reminder), da fehlt noch gänzlich das ui zum bearbeiten und hinzufügen actually.

# Food-Log Tab (ehemalig Journal, bitte src/ datein überprüfen auf umbennenung)
AI Logger sucht verzweifelt nach Makros im Freitext, wird dort niemals welche finden.
findet dann nix & packt es auf die queue Liste, wo man es dann nochmal analysieren lassen kann und dann wird es erkannt, wobei die makro einträge immer noch fragwürdig überschlagsartig berechnet wurden, 
dies könnte aber auch vom meal catalog eintrag stammen. Dringend überprüfen.

# Catalog
fundamentale Speicherprobleme, weiß nicht ob sie von local oder firebase/firestore stammen oder einem doppelten sync, jedoch sind alle einträge doppelt vorhanden und beim löschen geht dann einiges schief, es fehlt das richtie ux feedback wenn man zB etwas loggt usw


