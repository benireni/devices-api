import type { Library } from './library';

/**
 * Seeds the web build with charts worth looking at.
 *
 * The web target exists only for CI's bundle check and for rendering documentation
 * screenshots, and its storage is in-memory, so it starts empty every load. It is never
 * reachable on device.
 *
 * The songs are Jobim on purpose. Bossa nova harmony is the demanding case for this app:
 * tetrads with tensions, altered dominants, diminished passing chords and slash bass
 * notes, frequently sitting above a single short syllable. If chord rendering and chart
 * layout hold up here they hold up anywhere. Lyrics are one-line excerpts — enough to
 * show chords over words, no more.
 */
export async function seedDemoLibrary(library: Library): Promise<void> {
  await library.createFolder('Repertório');
  await library.createFolder('Estudos');

  await note(
    library,
    'Repertório',
    'Garota de Ipanema',
    'Tom Jobim / Vinicius de Moraes',
    [
      '{start_of_verse: A}',
      '[Fmaj7]Olha que coisa mais [G7(9)]linda',
      'mais cheia de [Gm7]graça [Gb7(#11)]',
      '{end_of_verse}',
      '',
      '{start_of_verse: B}',
      '[Gmaj7]Ah, por que estou tão [B7(#11)]sozinho?',
      '[F#m7]Ah, por que tudo é tão [D7(b9)]triste?',
      '{end_of_verse}',
    ],
  );

  await note(library, 'Repertório', 'Corcovado', 'Tom Jobim', [
    '{start_of_verse: A}',
    '[Am6]Um cantinho, um violão',
    '[Am7(b5)]este amor, uma can[D7(b9)]ção',
    '[Gmaj7]para fazer feliz a quem se [G6]ama',
    '{end_of_verse}',
  ]);

  await note(library, 'Repertório', 'Insensatez', 'Tom Jobim / Vinicius de Moraes', [
    '{start_of_verse: A}',
    '[Dm]A insensatez [Dm/C#]que você [Dm7/C]fez',
    '[Bm7(b5)]coração mais sem cui[Bb]dado',
    '{end_of_verse}',
  ]);

  await note(library, 'Estudos', 'Acordes de passagem', null, [
    '{start_of_verse: Diminutos entre graus}',
    'Subindo: [C6]  [C#°]  [Dm7]  [D#°]  [Em7]',
    'Descendo: [Em7]  [Eb°]  [Dm7]  [Db°]  [C6]',
    '{end_of_verse}',
    '',
    '{start_of_verse: Tensões sobre o II-V-I}',
    '[Dm7(9)]  [G7(b13)]  [Cmaj7(9)]',
    '[Dm7(11)]  [G7(#9)]  [C6/9]',
    '[Cm7(b9)]  [F7(#11)]  [Bbmaj7(13)]',
    '{end_of_verse}',
    '',
    '{start_of_tab: Voicing de Dm7(9) sem tônica}',
    'e|--5--|',
    'B|--5--|',
    'G|--5--|',
    'D|--5--|',
    'A|-----|',
    'E|-----|',
    '{end_of_tab}',
  ]);

  await note(library, null, 'Ideia de sábado', null, [
    '{start_of_verse}',
    '[Am7]  [D7(b9)]  [Gmaj7]  [G6]',
    '{end_of_verse}',
  ]);
}

async function note(
  library: Library,
  folder: string | null,
  title: string,
  artist: string | null,
  body: string[],
): Promise<void> {
  const id = await library.createNote(folder, title);
  const header = [`{x_qtdn_id: ${id}}`, `{title: ${title}}`];
  if (artist !== null) header.push(`{artist: ${artist}}`);
  await library.saveNote(id, folder, [...header, '', ...body].join('\n'));
}
