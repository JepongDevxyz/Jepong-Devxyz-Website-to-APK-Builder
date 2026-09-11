import fs from 'node:fs';
import path from 'node:path';

export function patchAndroidVersionMetadata(
  appRoot,
  cfg
){

  const candidates = [
    path.join(
      appRoot,
      'build.gradle'
    ),

    path.join(
      appRoot,
      'build.gradle.kts'
    )
  ];

  const gradle =
    candidates.find(
      file =>
        fs.existsSync(
          file
        )
    );

  if(!gradle){
    throw new Error(
      'Could not find Android app Gradle file'
    );
  }

  const versionCode =
    Number(
      cfg.versionCode
    );

  const versionName =
    String(
      cfg.versionName ?? ''
    ).trim();

  if(
    !Number.isInteger(
      versionCode
    ) ||
    versionCode < 1
  ){
    throw new Error(
      `Invalid Android versionCode: ${cfg.versionCode}`
    );
  }

  if(!versionName){
    throw new Error(
      'Android versionName cannot be empty'
    );
  }

  let text =
    fs.readFileSync(
      gradle,
      'utf8'
    );

  const versionCodePattern =
    /^(\s*versionCode\s*(?:=\s*)?)\d+(\s*)$/m;

  const versionNamePattern =
    /^(\s*versionName\s*(?:=\s*)?)(["'])([^"']*)\2(\s*)$/m;

  if(
    !versionCodePattern.test(
      text
    )
  ){
    throw new Error(
      `versionCode not found in ${gradle}`
    );
  }

  if(
    !versionNamePattern.test(
      text
    )
  ){
    throw new Error(
      `versionName not found in ${gradle}`
    );
  }

  text =
    text.replace(
      versionCodePattern,
      (
        _match,
        prefix,
        suffix
      ) =>
        `${prefix}${versionCode}${suffix}`
    );

  text =
    text.replace(
      versionNamePattern,
      (
        _match,
        prefix,
        quote,
        _oldVersion,
        suffix
      ) => {

        const escaped =
          versionName
            .replace(
              /\\/g,
              '\\\\'
            )
            .replaceAll(
              quote,
              `\\${quote}`
            );

        return (
          prefix +
          quote +
          escaped +
          quote +
          suffix
        );
      }
    );

  fs.writeFileSync(
    gradle,
    text
  );

  return gradle;
}
