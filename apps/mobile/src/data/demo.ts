import type { Library } from './library';

/**
 * Seeds a few notes into the web build.
 *
 * The web target exists only for CI's bundle check and for rendering documentation
 * screenshots, and its storage is in-memory, so it starts empty every load. This gives
 * those two uses something real to show. It is never reachable on device.
 */
export async function seedDemoLibrary(library: Library): Promise<void> {
  await library.createFolder('Repertório');
  await library.createFolder('Aprendendo');

  const tempo = await library.createNote('Repertório', 'Tempo Perdido');
  await library.saveNote(
    tempo,
    'Repertório',
    [
      `{x_qtdn_id: ${tempo}}`,
      '{title: Tempo Perdido}',
      '{artist: Legião Urbana}',
      '',
      '{start_of_verse: Verse 1}',
      '[G]Todos os dias quando [D]acordo',
      'não tenho mais o [Em]tempo que passou',
      '{end_of_verse}',
      '',
      '{start_of_tab: Intro}',
      'e|---------------------|',
      'B|---------------------|',
      'G|-----0-----0-----2---|',
      'D|---0---0-------------|',
      'A|-2-------------------|',
      'E|---------------------|',
      '{end_of_tab}',
    ].join('\n'),
  );

  const eduardo = await library.createNote('Repertório', 'Eduardo e Mônica');
  await library.saveNote(
    eduardo,
    'Repertório',
    [
      `{x_qtdn_id: ${eduardo}}`,
      '{title: Eduardo e Mônica}',
      '{artist: Legião Urbana}',
      '',
      '{start_of_verse: Verse 1}',
      "Quem um dia irá dizer [G]que existe razão",
      'nas coisas feitas pelo [D]coração?',
      '{end_of_verse}',
    ].join('\n'),
  );

  const scale = await library.createNote('Aprendendo', 'Pentatonic shape 1');
  await library.saveNote(
    scale,
    'Aprendendo',
    [`{x_qtdn_id: ${scale}}`, '{title: Pentatonic shape 1}'].join('\n'),
  );

  const idea = await library.createNote(null, 'Riff idea, Tuesday');
  await library.saveNote(
    idea,
    null,
    [`{x_qtdn_id: ${idea}}`, '{title: Riff idea, Tuesday}', '', '[Am]  [F]  [C]  [G]'].join('\n'),
  );
}
