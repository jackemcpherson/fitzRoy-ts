# Match-Coach Fixture Provenance

The AFL Tables profile fixtures are full HTML-only downloads saved from the
primary-source pages through native Google Chrome on 3 October 2026. They replace
the earlier reconstructed rows. The captures retain their original content.
`captures.json`
records each URL, capture time, byte length, SHA-256 and download method.

Browser Save Page As is the capture method. No independent raw HTTP comparison
verified byte equivalence. The parser tests now exercise the complete
downloaded profile markup.

| Fixture  | Primary source                                                                | Credits retained                                                           |
| -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hansen   | [Ashley Hansen](https://afltables.com/afl/stats/coaches/Ashley_Hansen.html)   | Carlton, round 2 of 2022                                                   |
| Bolton   | [Brendon Bolton](https://afltables.com/afl/stats/coaches/Brendon_Bolton.html) | Hawthorn, rounds 11 through 15 of 2014                                     |
| Connolly | [Chris Connolly](https://afltables.com/afl/stats/coaches/Chris_Connolly.html) | Hawthorn, round 17 of 2001                                                 |
| Teague   | [David Teague](https://afltables.com/afl/stats/coaches/David_Teague.html)     | All 11 Carlton credits in 2019, beginning in round 12                      |
| Voss     | [Michael Voss](https://afltables.com/afl/stats/coaches/Michael_Voss.html)     | Full profile, 21 Carlton credits in 2022 exported for application fixtures |

`afl-tables-index-captured.html` is the complete captured provider index. Its
public batch regression verifies the exclusion of club-navigation links.
`afl-tables-index.html` remains synthetic navigation for focused request dispatch.
The FootyWire
fixture uses explicitly synthetic coach identities and profile links. It tests
extraction and partial failure only. It supplies no historical attribution or
coverage evidence.
